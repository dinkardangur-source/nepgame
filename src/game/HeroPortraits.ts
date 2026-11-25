import bhimsenPortrait from '../assets/images/hero_bhimsen_thapa.webp';
import bhaktiPortrait from '../assets/images/hero_bhakti_thapa.webp';
import balbhadraPortrait from '../assets/images/hero_balbhadra_kunwar.webp';
import yogamayaPortrait from '../assets/images/hero_yogamaya_devi.webp';
import damodarPortrait from '../assets/images/hero_damodar_pande.webp';

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
