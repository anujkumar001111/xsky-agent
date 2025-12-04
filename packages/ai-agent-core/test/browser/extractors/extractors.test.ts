import { JSDOM } from 'jsdom';
import { extract_structure, extract_styles } from '../../../src/agent/browser/extractors';

describe('JS Extractors', () => {

  it('should extract structure correctly', () => {
    const dom = new JSDOM(`
      <div id="parent" class="container">
        <span id="child">Hello</span>
      </div>
    `, { runScripts: "dangerously" });

    // Mock getBoundingClientRect
    dom.window.HTMLElement.prototype.getBoundingClientRect = () => ({
        x: 0, y: 0, width: 100, height: 100, top: 0, left: 0, bottom: 100, right: 100, toJSON: () => {}
    });

    // Mock getComputedStyle to avoid JSDOM not implemented error
    const originalGetComputedStyle = dom.window.getComputedStyle;
    dom.window.getComputedStyle = (elt: any, pseudoElt?: string | null) => {
      try {
        return originalGetComputedStyle(elt, pseudoElt);
      } catch (e) {
        return {
          getPropertyValue: () => '',
        } as any;
      }
    };

    // Execute script by serializing the function
    const script = `(${extract_structure.toString()})(document.body)`;
    const result = dom.window.eval(script);

    expect(Array.isArray(result)).toBe(true);
    const parent = result.find((el: any) => el.id === 'parent');
    expect(parent).toBeDefined();
    expect(parent.tagName).toBe('div');
    expect(parent.className).toBe('container');
    expect(parent.children).toContain('child');
  });

  it('should extract styles correctly', () => {
    const dom = new JSDOM('<div id="styled" style="color: red;">Styled</div>', { runScripts: "dangerously" });

    // Mock getComputedStyle to avoid JSDOM not implemented error
    const originalGetComputedStyle = dom.window.getComputedStyle;
    dom.window.getComputedStyle = (elt: any, pseudoElt?: string | null) => {
      try {
        return originalGetComputedStyle(elt, pseudoElt);
      } catch (e) {
        return {
          getPropertyValue: () => '',
          color: 'red'
        } as any;
      }
    };

    // JSDOM supports basic computed styles
    const script = `(${extract_styles.toString()})(document.body)`;
    const result = dom.window.eval(script);
    const styled = result.find((el: any) => el.id === 'styled');

    expect(styled).toBeDefined();
    // JSDOM might return RGB
    const color = styled.computedStyles.color;
    expect(color === 'red' || color === 'rgb(255, 0, 0)').toBe(true);
  });
});
