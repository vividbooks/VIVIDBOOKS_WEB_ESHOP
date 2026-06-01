type FlipbookPreviewPaneProps = {
  flipbookUrl: string;
  title: string;
};

export function FlipbookPreviewPane({ flipbookUrl, title }: FlipbookPreviewPaneProps) {
  return (
    <iframe
      src={flipbookUrl}
      title={`Ukázka: ${title}`}
      className="h-full min-h-[360px] w-full border-0 bg-[#f3f3f0]"
      allow="fullscreen; clipboard-read; clipboard-write"
      loading="lazy"
    />
  );
}
