import type { CaptionPanel } from './types';

export const PANEL_PRESETS = {
  none: {label:'None',shape:'none',fill:'#15202B',border:'#15202B',opacity:100,ink:'#FFFFFF',arabicInk:'#E9DCB9'},
  solid: {label:'Solid box',shape:'box',fill:'#141820',border:'#141820',opacity:94,ink:'#FFFFFF',arabicInk:'#FFFFFF'},
  glass: {label:'Smoked glass',shape:'rounded',fill:'#17202C',border:'#718096',opacity:72,ink:'#FFFFFF',arabicInk:'#E5EBF3'},
  gold: {label:'Gold frame',shape:'rounded',fill:'#171C24',border:'#D7B66A',opacity:88,ink:'#F8F1E5',arabicInk:'#ECD292'},
  paper: {label:'Parchment',shape:'ticket',fill:'#EADAB4',border:'#AB8545',opacity:100,ink:'#29251D',arabicInk:'#453721'},
  emerald: {label:'Emerald plaque',shape:'cartouche',fill:'#0C4C40',border:'#D8B46B',opacity:100,ink:'#FFFCF3',arabicInk:'#F2DFAB'},
  azure: {label:'Azure plaque',shape:'cartouche',fill:'#086A86',border:'#D9B361',opacity:100,ink:'#FFFFFF',arabicInk:'#FFF1C9'},
  midnight: {label:'Midnight ribbon',shape:'ticket',fill:'#202E48',border:'#B7A57D',opacity:98,ink:'#FFFFFF',arabicInk:'#E5D3A8'},
} as const;
export function createPanel(preset: CaptionPanel['preset'] = 'none'): CaptionPanel {
  const data=PANEL_PRESETS[preset];
  return {preset,fill:data.fill,border:data.border,opacity:data.opacity,width:88,padding:28,borderWidth:3};
}
