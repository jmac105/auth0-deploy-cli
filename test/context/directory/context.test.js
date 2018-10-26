import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/directory';
import { cleanThenMkdir, testDataDir } from '../../utils';


describe('#directory context validation', () => {
  it('should do nothing on empty repo', async () => {
    /* Create empty directory */
    const dir = path.resolve(testDataDir, 'directory', 'empty');
    cleanThenMkdir(dir);

    const context = new Context({ AUTH0_INPUT_FILE: dir });
    await context.load();

    expect(context.assets.rules).to.deep.equal([]);
    expect(context.assets.databases).to.deep.equal([]);
    expect(context.assets.pages).to.deep.equal([]);
    expect(context.assets.clients).to.deep.equal([]);
    expect(context.assets.resourceServers).to.deep.equal([]);
  });

  it('should error on bad directory', async () => {
    const dir = path.resolve(testDataDir, 'directory', 'doesNotExist');
    const context = new Context({ AUTH0_INPUT_FILE: dir });
    const errorMessage = `Not sure what to do with, ${dir} as it is not a directory...`;
    await expect(context.load())
      .to.be.eventually.rejectedWith(Error)
      .and.have.property('message', errorMessage);
  });

  it('should error on symlink', async () => {
    const dir = path.resolve(testDataDir, 'directory', 'badSymlink');
    const file = path.join(dir, 'badSymLink');
    const link = path.join(dir, 'link');
    try {
      fs.unlinkSync(link);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }

    cleanThenMkdir(dir);
    fs.symlinkSync(file, link);

    const context = new Context({ AUTH0_INPUT_FILE: link });
    const errorMessage = `Not sure what to do with, ${link} as it is not a directory...`;
    await expect(context.load())
      .to.be.eventually.rejectedWith(Error)
      .and.have.property('message', errorMessage);
  });
});
