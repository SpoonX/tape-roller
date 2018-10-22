import createDebug from 'debug';
import { Writable } from 'stream';
import { stream, createTransform } from 'procurator';
import * as fs from 'fs';
import { ModifyType, SubjectType } from './types';
import * as util from 'util';
import * as path from 'path';
import { IOptions } from 'glob';

const debug = createDebug('tape-roller:FileTask');
export const TMP_POSTFIX = '___TMP';

export class FileTask {
  private subjects: SubjectType[] = [];

  private readonly concatFileName: boolean;

  private options: IOptions = {};

  public constructor (files: string | string[], concatFileName: boolean = false, options: IOptions = {}) {
    this.concatFileName = concatFileName;
    this.options = options;

    (!Array.isArray(files) ? [ files ] : files as string[]).forEach(file => this.addSubject(file));
  }

  private addSubject (file: string) {
    debug(`Creating new task for "${file}"`);

    const filePath = this.options.cwd ? path.resolve(this.options.cwd, file) : file;

    debug(`Reading from "${filePath}"`);

    this.subjects.push({ file, stream: fs.createReadStream(filePath) });
  }

  public write (destinationName?: string) {
    const writes = this.subjects.map((subject: SubjectType) => this.writeFile(subject, destinationName));

    return Promise.all(writes);
  }

  public async update () {
    const writes = this.subjects.map(async (subject: SubjectType) => {
      await this.writeFile(subject, subject.file + TMP_POSTFIX);

      return util.promisify(fs.rename)(subject.file + TMP_POSTFIX, subject.file);
    });

    return Promise.all(writes);
  }

  public async writeFile (subject: SubjectType, destinationName: string) {
    const destination = this.concatFileName ? path.resolve(destinationName, subject.file) : destinationName;

    debug(`Creating write to ${this.concatFileName ? 'concatenated' : 'regular'} destination "${destination}".`);

    try {
      await util.promisify(fs.mkdir)(path.parse(destination).dir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }

    const writeStream = fs.createWriteStream(destination);

    subject.stream = subject.stream.pipe(writeStream);

    return new Promise<void>((resolve, reject) => {
      writeStream.on('error', reject);
      writeStream.on('finish', resolve);
    });
  }

  public replace (parameters: { [key: string]: any }): this {
    this.pipe(() => stream(parameters, true, 100));

    return this;
  }

  public modify (pattern: RegExp, { append, prepend, custom, replace }: ModifyType): this {
    const transformer = (match: string, parameter: string, defaultValue: string): string => {
      if (typeof replace !== 'undefined') {
        return replace;
      }

      if (typeof append !== 'undefined') {
        return match + append;
      }

      if (typeof prepend !== 'undefined') {
        return prepend + match;
      }

      if (typeof custom === 'function') {
        return custom(match, parameter, defaultValue);
      }

      return match;
    };

    this.pipe(() => createTransform(chunk => chunk.replace(pattern, transformer)));

    return this;
  }

  public pipe (through: () => Writable): this {
    this.subjects.forEach(subject => {
      subject.stream = subject.stream.pipe(through());
    });

    return this;
  }
}
