import {workOperationLabels as originalLabels} from '../workflow/workCopyPresentation.mjs?cloud-original';
export function workOperationLabels(meta,options){
  const labels=originalLabels(meta,options);
  if(meta?.source!=='cloud-shared-synthetic'||meta.cloudSynthetic!==true)return labels;
  return {...labels,sampleBadge:'<span class="pill">Sentetik Cloud TEST</span>',sampleTag:' · Sentetik Cloud TEST',productChoice:'Sentetik ürünü seçin',
    salesTitle:'Satışa uygun sentetik ürünler',salesNote:'Bu ürünler, fiyatlar ve stok yalnız ortak sentetik TEST veritabanına aittir. Taslak ve satış tamamlama ayrı adımlardır.',
    catalogHelp:'Bu sentetik denemede yukarıdaki ürün seçimlerini kullanın. Harici kart ve fotoğraf kaynağı bağlı değildir.'};
}
