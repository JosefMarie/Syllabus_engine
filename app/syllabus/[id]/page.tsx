export async function generateStaticParams() {
  // Return a dummy path so static export succeeds without failing on unknown dynamic paths
  return [{ id: "legacy" }];
}

export default function LegacySyllabus() {
  return (
    <div className="p-8 text-white flex flex-col items-center justify-center min-h-screen bg-[#0B0F19]">
      <h1>This route has been deprecated.</h1>
      <p>Please use the new Syllabus Viewer using /syllabus/view?id=...</p>
    </div>
  );
}
