import { extract_structure } from './extract_structure';
import { extract_styles } from './extract_styles';
import { extract_events } from './extract_events';
import { extract_assets } from './extract_assets';
import { comprehensive_element_extractor } from './comprehensive_element_extractor';
import { extract_related_files } from './extract_related_files';
import { extract_animations } from './extract_animations';
import { setup_mutation_observer } from './setup_mutation_observer';

export const EXTRACTORS: Record<string, Function> = {
  'extract_structure.js': extract_structure,
  'extract_styles.js': extract_styles,
  'extract_events.js': extract_events,
  'extract_assets.js': extract_assets,
  'comprehensive_element_extractor.js': comprehensive_element_extractor,
  'extract_related_files.js': extract_related_files,
  'extract_animations.js': extract_animations,
  'setup_mutation_observer.js': setup_mutation_observer
};

// Re-export individual functions for direct import
export {
  extract_structure,
  extract_styles,
  extract_events,
  extract_assets,
  comprehensive_element_extractor,
  extract_related_files,
  extract_animations,
  setup_mutation_observer
};
