import bhimsenPortrait from '../assets/images/hero_bhimsen_thapa_1795354185737.jpg';
import bhaktiPortrait from '../assets/images/hero_bhakti_thapa_1795354185265.jpg';
import balbhadraPortrait from '../assets/images/hero_balbhadra_kunwar_1795354188069.jpg';
import yogamayaPortrait from '../assets/images/hero_yogamaya_devi_1795354186352.jpg';
import damodarPortrait from '../assets/images/hero_damodar_pande_1795354185705.jpg';

export const HERO_PORTRAIT_URLS: Record<string, string> = {
  hero_bhimsen_thapa: bhimsenPortrait,
  hero_bhakti_thapa: bhaktiPortrait,
  hero_balbhadra_kunwar: balbhadraPortrait,
  hero_yogamaya_devi: yogamayaPortrait,
  hero_damodar_pande: damodarPortrait,
};

export function getHeroPortraitUrl(heroId?: string | null): string {
  if (!heroId) return bhimsenPortrait;
  return HERO_PORTRAIT_URLS[heroId] || bhimsenPortrait;
}
