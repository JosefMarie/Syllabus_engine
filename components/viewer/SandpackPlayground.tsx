"use client";

import React from "react";
import { 
  SandpackProvider, 
  SandpackLayout, 
  SandpackCodeEditor, 
  SandpackPreview,
  SandpackConsole
} from "@codesandbox/sandpack-react";
import { Play, Terminal, Code2 } from "lucide-react";
import { CodeSnippet } from "@/types/syllabus";

interface Props {
  snippet: CodeSnippet;
}

export default function SandpackPlayground({ snippet }: Props) {
  const template = snippet.template || (snippet.language === 'typescript' || snippet.language === 'javascript' ? 'react' : 'vanilla');

  return (
    <div className="my-6 rounded-xl border border-[#334155] bg-[#0F172A] overflow-hidden shadow-xl">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#1E293B] border-b border-[#334155]">
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded bg-[#06B6D4]/10 text-[#06B6D4]">
            <Code2 className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-white tracking-wide uppercase">
            {snippet.title || "Executable Code Playground"}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-[#10B981]/15 text-[#10B981]">
            <Play className="w-3 h-3 mr-1 fill-current" />
            Live Sandpack Runner
          </span>
        </div>
      </div>

      <SandpackProvider
        template={template as any}
        theme={{
          colors: {
            surface1: "#0F172A",
            surface2: "#1E293B",
            surface3: "#334155",
            clickable: "#94A3B8",
            base: "#CBD5E1",
            disabled: "#64748B",
            hover: "#FFFFFF",
            accent: "#06B6D4",
          },
          syntax: {
            plain: "#E2E8F0",
            comment: "#64748B",
            keyword: "#06B6D4",
            tag: "#F59E0B",
            punctuation: "#94A3B8",
            definition: "#10B981",
            property: "#38BDF8",
            static: "#F43F5E",
            string: "#10B981",
          },
          font: {
            body: 'var(--font-sans)',
            mono: 'var(--font-mono)',
            size: "13px",
            lineHeight: "1.6",
          },
        }}
        files={{
          "/App.js": snippet.code,
        }}
      >
        <SandpackLayout className="!border-none">
          <SandpackCodeEditor 
            showLineNumbers 
            showInlineErrors 
            wrapContent 
            className="!h-[320px] font-mono text-xs"
          />
          <SandpackPreview 
            showNavigator={false} 
            showRefreshButton={true}
            className="!h-[320px] bg-white text-slate-900"
          />
        </SandpackLayout>
        <div className="border-t border-[#334155] bg-[#0B0F19]">
          <div className="px-4 py-2 flex items-center justify-between text-xs font-mono text-[#94A3B8] border-b border-[#1E293B] bg-[#0B0F19]">
            <div className="flex items-center">
              <Terminal className="w-4 h-4 mr-2 text-[#06B6D4]" />
              <span className="font-bold uppercase tracking-wider text-white">Console Output</span>
            </div>
            <span className="text-[10px] text-[#64748B]">Real-time Terminal Logs</span>
          </div>
          <SandpackConsole className="!h-[180px] !bg-[#0B0F19] text-sm font-mono overflow-y-auto" />
        </div>
      </SandpackProvider>
    </div>
  );
}
