/**
 * Minimal Lexical editor state builders for scripts and tests. Authors use the admin editor;
 * this only produces the plain paragraphs that seed data and tests need.
 */

type LexicalTextNode = {
  type: 'text'
  version: 1
  text: string
  detail: 0
  format: 0
  mode: 'normal'
  style: ''
}

type LexicalParagraph = {
  type: 'paragraph'
  version: 1
  direction: 'ltr'
  format: ''
  indent: 0
  textFormat: 0
  children: LexicalTextNode[]
}

export type LexicalState = {
  root: {
    type: 'root'
    version: 1
    direction: 'ltr'
    format: ''
    indent: 0
    children: LexicalParagraph[]
  }
}

export function paragraphsToLexical(paragraphs: readonly string[]): LexicalState {
  return {
    root: {
      type: 'root',
      version: 1,
      direction: 'ltr',
      format: '',
      indent: 0,
      children: paragraphs.map((text) => ({
        type: 'paragraph',
        version: 1,
        direction: 'ltr',
        format: '',
        indent: 0,
        textFormat: 0,
        children: [
          { type: 'text', version: 1, text, detail: 0, format: 0, mode: 'normal', style: '' },
        ],
      })),
    },
  }
}
