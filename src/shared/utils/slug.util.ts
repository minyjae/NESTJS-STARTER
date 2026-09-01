export interface GenerateSlugOptions {
  maxLength?: number;
  separator?: string;
  checkExists?: (slug: string) => Promise<boolean>;
}

export async function generateSlug(
  title: string,
  options: GenerateSlugOptions = {},
): Promise<string> {
  const separator = options.separator ?? '-';
  const maxLength = options.maxLength ?? 80;
  const baseSlug = title
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/[\s_-]+/g, separator)
    .replace(new RegExp(`^${separator}+|${separator}+$`, 'g'), '')
    .slice(0, maxLength)
    .replace(new RegExp(`${separator}+$`, 'g'), '');

  if (!options.checkExists) {
    return baseSlug;
  }

  let slug = baseSlug;
  let suffix = 1;

  while (await options.checkExists(slug)) {
    const suffixText = `${separator}${suffix}`;
    slug = `${baseSlug.slice(0, maxLength - suffixText.length)}${suffixText}`;
    suffix += 1;
  }

  return slug;
}
