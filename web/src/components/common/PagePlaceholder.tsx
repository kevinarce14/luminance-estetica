interface PagePlaceholderProps {
  title: string
  legacyFile: string
  description: string
}

export function PagePlaceholder({
  title,
  legacyFile,
  description,
}: PagePlaceholderProps) {
  return (
    <section className="placeholder">
      <p className="placeholder__eyebrow">En construcción</p>
      <h1>{title}</h1>
      <p className="placeholder__description">{description}</p>
      <p className="placeholder__legacy">
        Referencia legado: <code>{legacyFile}</code>
      </p>
    </section>
  )
}
