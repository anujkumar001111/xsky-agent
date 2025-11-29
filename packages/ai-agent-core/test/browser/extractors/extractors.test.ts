import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('JS Extractors', () => {
  const extractorsPath = path.resolve(__dirname, '../../../src/agent/browser/extractors');

  it('should extract structure correctly', () => {
    const script = fs.readFileSync(path.join(extractorsPath, 'extract_structure.js'), 'utf-8');
    const dom = new JSDOM(`
      <div id="parent" class="container">
        <span id="child">Hello</span>
      </div>
    `, { runScripts: "dangerously" });

    // Mock getBoundingClientRect
    dom.window.HTMLElement.prototype.getBoundingClientRect = () => ({
        x: 0, y: 0, width: 100, height: 100, top: 0, left: 0, bottom: 100, right: 100, toJSON: () => {}
    });

    // Execute script
    dom.window.eval(script.replace('return extractStructure();', 'window._result = extractStructure(document.body);'));
    const result = (dom.window as any)._result;

    expect(result).to.be.an('array');
    const parent = result.find((el: any) => el.id === 'parent');
    expect(parent).to.exist;
    expect(parent.tagName).to.equal('div');
    expect(parent.className).to.equal('container');
    expect(parent.children).to.include('child');
  });

  it('should extract styles correctly', () => {
    const script = fs.readFileSync(path.join(extractorsPath, 'extract_styles.js'), 'utf-8');
    const dom = new JSDOM('<div id="styled" style="color: red;">Styled</div>', { runScripts: "dangerously" });

    // JSDOM supports basic computed styles
    dom.window.eval(script.replace('return extractStyles();', 'window._result = extractStyles(document.body);'));
    const result = (dom.window as any)._result;
    const styled = result.find((el: any) => el.id === 'styled');

    expect(styled).to.exist;
    expect(styled.computedStyles.color).to.satisfy((c: string) => c === 'red' || c === 'rgb(255, 0, 0)');
  });
});
