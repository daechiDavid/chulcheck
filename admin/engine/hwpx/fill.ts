const PLACEHOLDER = /\{\{([^}]+)\}\}/g

export function xmlEscapeText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function xmlTextValue(value: string): string {
  return xmlEscapeText(value).replace(/\r\n|\n|\r/g, '</hp:t><hp:lineBreak/><hp:t>')
}

export function remainingPlaceholders(xml: string): string[] {
  return [...xml.matchAll(/\{\{([^}]+)\}\}/g)].map((match) => match[1])
}

export function stripLineseg(xml: string): string {
  return xml.replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/g, '')
}

export function fillXml(xml: string, values: Record<string, string>): string {
  const missing = new Set<string>()
  const filled = xml.replace(PLACEHOLDER, (token, key: string) => {
    if (!(key in values)) {
      missing.add(key)
      return token
    }
    return xmlTextValue(values[key] ?? '')
  })
  if (missing.size) {
    throw new Error(`치환되지 않은 항목: ${[...missing].join(', ')}`)
  }
  const left = remainingPlaceholders(filled)
  if (left.length) {
    throw new Error(`치환되지 않은 항목: ${[...new Set(left)].join(', ')}`)
  }
  return stripLineseg(filled)
}

export function extractPlaceholderKeys(xml: string): string[] {
  return [...new Set(remainingPlaceholders(xml))]
}
