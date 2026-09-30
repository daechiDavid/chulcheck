declare module 'pdf-to-printer' {
  export function print(file: string, options?: { printer?: string }): Promise<void>
}
