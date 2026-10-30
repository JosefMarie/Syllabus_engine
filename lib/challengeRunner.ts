import { ChallengeTestCase } from "@/types/challenge";

export interface TestResult {
  testId: string;
  description?: string;
  input: string;
  expected: string;
  actual?: string;
  passed: boolean;
  error?: string;
  isHidden?: boolean;
}

export interface RunResultsSummary {
  allPassed: boolean;
  testsPassed: number;
  testsTotal: number;
  results: TestResult[];
  logs: string[];
  executionTimeMs: number;
  generalError?: string;
}

export async function runChallengeTests(
  code: string,
  functionName: string,
  testCases: ChallengeTestCase[]
): Promise<RunResultsSummary> {
  const startTime = performance.now();
  const logs: string[] = [];
  const results: TestResult[] = [];

  // Capture logs
  const customConsole = {
    log: (...args: any[]) => {
      logs.push(args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" "));
    },
    error: (...args: any[]) => {
      logs.push("[ERROR] " + args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" "));
    },
    warn: (...args: any[]) => {
      logs.push("[WARN] " + args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" "));
    }
  };

  try {
    // Construct sandbox function
    // Wrap code and extract target function
    const wrappedCode = `
      ${code}
      if (typeof ${functionName} !== 'function') {
        throw new Error('Target function "${functionName}" is not defined or exported.');
      }
      return ${functionName};
    `;

    // Safe constructor evaluation
    const evaluator = new Function("console", wrappedCode);
    const targetFn = evaluator(customConsole);

    let allPassed = true;

    for (const tc of testCases) {
      let passed = false;
      let actualValStr = "";
      let errorStr: string | undefined = undefined;

      try {
        // Parse input safely. Supports multi-argument input e.g. [arg1, arg2]
        let parsedInput: any;
        try {
          parsedInput = JSON.parse(tc.input);
        } catch {
          parsedInput = tc.input;
        }

        // Timeout wrapper for infinite loops
        const runWithTimeout = () => {
          if (Array.isArray(parsedInput)) {
            return targetFn(...parsedInput);
          }
          return targetFn(parsedInput);
        };

        const result = runWithTimeout();
        actualValStr = typeof result === "object" ? JSON.stringify(result) : String(result);

        // Normalize comparison
        const normalizedActual = actualValStr.trim();
        const normalizedExpected = tc.expectedOutput.trim();

        if (normalizedActual === normalizedExpected) {
          passed = true;
        } else {
          // Try JSON comparison if string mismatch
          try {
            const actualObj = JSON.parse(actualValStr);
            const expectedObj = JSON.parse(tc.expectedOutput);
            if (JSON.stringify(actualObj) === JSON.stringify(expectedObj)) {
              passed = true;
            }
          } catch {
            passed = false;
          }
        }
      } catch (err: any) {
        passed = false;
        errorStr = err?.message || String(err);
      }

      if (!passed) {
        allPassed = false;
      }

      results.push({
        testId: tc.id,
        description: tc.description,
        input: tc.input,
        expected: tc.expectedOutput,
        actual: actualValStr,
        passed,
        error: errorStr,
        isHidden: tc.isHidden
      });
    }

    const endTime = performance.now();
    const testsPassed = results.filter((r) => r.passed).length;

    return {
      allPassed,
      testsPassed,
      testsTotal: testCases.length,
      results,
      logs,
      executionTimeMs: Math.round(endTime - startTime)
    };
  } catch (err: any) {
    const endTime = performance.now();
    return {
      allPassed: false,
      testsPassed: 0,
      testsTotal: testCases.length,
      results: testCases.map((tc) => ({
        testId: tc.id,
        description: tc.description,
        input: tc.input,
        expected: tc.expectedOutput,
        passed: false,
        error: "Compilation or syntax error: " + (err?.message || String(err)),
        isHidden: tc.isHidden
      })),
      logs,
      executionTimeMs: Math.round(endTime - startTime),
      generalError: err?.message || String(err)
    };
  }
}
