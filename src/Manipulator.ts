import { FileTask } from './FileTask';

export class Manipulator extends FileTask {
  public addImport (module: string, name: string) {
    const importString = `import ${name} from '${module}';\n`;

    return this
      .modify(/.*?import .+;\n(?=\n)/im, { append: importString })
      .modify(/^(?!import)/, { prepend: importString });
  }

  public addNamedImport (module: string, name: string) {
    return this
      .modify(new RegExp(`import ([^{}]+)(?= from ['"]${module}['"];?)`, 'g'), { append: `, { ${name} }` })
      .modify(
        new RegExp(`^import (?:\\w+, )?{(\\n\\s+)?(?![^}]*\\b${name}\\b)([\\w ,\\n]+)(?=\\b\\s?} from ['"]${module}['"];?$)`, 'gm'),
        { custom: (match: string, newline: string) => `${match},${newline || ' '}${name}` }
      );
  }
}

