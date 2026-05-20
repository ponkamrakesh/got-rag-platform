type Source = {
  text: string
  book: string
  chapter?: string
  start_page?: number
  end_page?: number
  image_path?: string
  type?: string
}

export default function SourceCard({
  source,
  index,
}: {
  source: Source
  index: number
}) {
  const pageDisplay =
    source.start_page && source.end_page && source.start_page !== source.end_page
      ? `p.${source.start_page}-${source.end_page}`
      : `p.${source.start_page ?? '?'}`

  return (
    <div className="bg-iron-700/60 border border-iron-600 rounded-md p-3 text-xs transition hover:border-iron-500">
      <div className="flex items-center justify-between mb-2">
        <span className="text-fire-300 font-bold truncate mr-2">
          [{index + 1}] {source.book}
        </span>
        <span className="text-zinc-500 shrink-0">{pageDisplay}</span>
      </div>

      {source.image_path && (
        <img
          src={source.image_path}
          alt="Retrieved source"
          className="w-full h-28 object-cover rounded border border-iron-500 mb-2"
          loading="lazy"
        />
      )}

      {source.chapter && (
        <div className="text-[10px] uppercase tracking-wider text-ice-300 mb-1">
          {source.chapter}
        </div>
      )}

      <p className="text-zinc-300 line-clamp-5 leading-relaxed">{source.text}</p>
    </div>
  )
}
