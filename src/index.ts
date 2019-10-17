import execa from 'execa';
import { oc } from 'ts-optchain.macro';
import fs from 'fs-extra';
import ora from 'ora';
import path from 'path';
import pkgDir from 'pkg-dir';
import { Command, flags } from '@oclif/command';
import { mapSeries } from 'bluebird';

export interface File {
  count: number;
  lines: string[];
  path: string;
}

export interface Files {
  [key: string]: File;
}

const rootPath = pkgDir.sync(process.cwd()) || process.cwd();

export default class TSIgnore extends Command {
  static description = 'ignore typescript errors';

  static flags = {
    help: flags.help({ char: 'h' }),
    version: flags.version({ char: 'v' })
  };

  async run() {
    const spinner = ora();
    spinner.start('finding errors');
    const files: Files = {};
    const lines = (await execa('tsc', ['--noEmit'], { cwd: rootPath }).catch(
      err => {
        if (err.stdout) return err;
        throw err;
      }
    )).stdout.split('\n');
    spinner.start('fixing errors');
    let count = 0;
    await mapSeries(lines, async (line: string) => {
      const [, filePath, lineNumber] = line.match(
        /(.+\.tsx?)\((\d+),\d+\): error TS\d{4}: /
      ) || [null, null, null];
      if (!filePath) return;
      if (!(filePath in files)) {
        files[filePath] = {
          count: 0,
          lines: (await fs.readFile(filePath)).toString().split('\n'),
          path: path.resolve(process.cwd(), filePath)
        };
      }
      ++count;
      const file = files[filePath];
      const padding: number = oc(
        file.lines[Number(lineNumber) + file.count - 1].match(/^ */)
      )([''])[0].length;
      file.lines.splice(
        Number(lineNumber) + file.count - 1,
        0,
        `${Array(padding)
          .fill(' ')
          .join('')}// @ts-ignore`
      );
      ++file.count;
    });
    await Promise.all(
      Object.values(files).map(async (file: File) => {
        await fs.writeFile(file.path, file.lines.join('\n'));
      })
    );
    spinner.succeed(`fixed ${count} errors`);
  }
}
