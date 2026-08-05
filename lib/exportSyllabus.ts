import { Syllabus } from "@/types/syllabus";

/**
 * Downloads a single syllabus object as a formatted JSON file.
 * Restricted to Admin / Teacher access.
 */
export function downloadSyllabusAsJSON(syllabus: Syllabus) {
  if (typeof window === "undefined") return;

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(syllabus, null, 2));
  const downloadAnchor = document.createElement("a");
  const fileName = `${syllabus.courseCode || "Syllabus"}_${syllabus.id || "export"}_syllabus.json`;

  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", fileName);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * Downloads a single syllabus formatted as a clean readable text/markdown document.
 * Restricted to Admin / Teacher access.
 */
export function downloadSyllabusAsText(syllabus: Syllabus) {
  if (typeof window === "undefined") return;

  let text = `========================================================================\n`;
  text += `COURSE SYLLABUS: ${syllabus.title.toUpperCase()}\n`;
  text += `========================================================================\n\n`;
  text += `Course Code  : ${syllabus.courseCode}\n`;
  text += `Level        : ${syllabus.level || "Unassigned"}\n`;
  text += `Status       : ${syllabus.status.toUpperCase()}\n`;
  text += `Last Updated : ${new Date(syllabus.updatedAt).toLocaleString()}\n\n`;
  text += `COURSE DESCRIPTION:\n${syllabus.description}\n\n`;

  text += `------------------------------------------------------------------------\n`;
  text += `5-LEVEL SYLLABUS STRUCTURE & DETAILED CONTENT\n`;
  text += `------------------------------------------------------------------------\n\n`;

  syllabus.learningOutcomes?.forEach((lo, loIdx) => {
    text += `LEVEL 1: LEARNING OUTCOME #${loIdx + 1}: ${lo.title}\n`;
    if (lo.description) text += `Description: ${lo.description}\n`;
    text += `\n`;

    lo.indicativeContents?.forEach((ic, icIdx) => {
      text += `  LEVEL 2: INDICATIVE CONTENT #${icIdx + 1}: ${ic.title}\n\n`;

      ic.topics?.forEach((top, topIdx) => {
        text += `    LEVEL 3: TOPIC #${topIdx + 1}: ${top.title}\n\n`;

        top.subtopics?.forEach((sub, subIdx) => {
          text += `      LEVEL 5: SUBTOPIC #${sub.order || subIdx + 1}: ${sub.title}\n`;
          text += `      --------------------------------------------------\n`;
          text += `      CONTENT:\n${sub.contentMarkdown || "No detailed text content available."}\n\n`;
          
          if (sub.codeSnippet) {
            text += `      INTERACTIVE CODE EXERCISE:\n`;
            text += `      [Language]: ${sub.codeSnippet.language || "javascript"}\n`;
            text += `      [Code]:\n${sub.codeSnippet.code}\n\n`;
          }
        });
      });
    });
  });

  if (syllabus.citationsDictionary && Object.keys(syllabus.citationsDictionary).length > 0) {
    text += `------------------------------------------------------------------------\n`;
    text += `CITATIONS & GLOSSARY DICTIONARY\n`;
    text += `------------------------------------------------------------------------\n\n`;
    Object.values(syllabus.citationsDictionary).forEach((cit) => {
      text += `Term: ${cit.term}\n`;
      text += `Definition/Explanation: ${cit.explanation}\n`;
      if (cit.source) text += `Source: ${cit.source}\n`;
      text += `\n`;
    });
  }

  text += `========================================================================\n`;
  text += `END OF SYLLABUS DOCUMENT\n`;
  text += `Generated via Syllabus Engine Admin Portal on ${new Date().toLocaleString()}\n`;
  text += `========================================================================\n`;

  const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(text);
  const downloadAnchor = document.createElement("a");
  const fileName = `${syllabus.courseCode || "Syllabus"}_full_document.txt`;

  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", fileName);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * Exports all syllabi in the database as a single JSON array export file.
 * Restricted to Admin / Teacher access.
 */
export function downloadAllSyllabiAsJSON(syllabi: Syllabus[]) {
  if (typeof window === "undefined") return;

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(syllabi, null, 2));
  const downloadAnchor = document.createElement("a");
  const fileName = `all_course_syllabi_export_${new Date().toISOString().split('T')[0]}.json`;

  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", fileName);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
