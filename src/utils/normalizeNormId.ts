export const normalizeNormId = (id: string): string => { 
  return id 
    .toUpperCase() .normalize('NFD')  // separa letras y acentos 
    .replace(/[\u0300-\u036f]/g, '')  // elimina acentos 
    .replace(/\s+/g, ' ')  // colapsa espacios 
    .replace('D.S.', 'DECRETO SUPREMO') 
    .replace('DS', 'DECRETO SUPREMO') 
    .replace('R.S.', 'RESOLUCION SUPREMA') 
    .replace('RS', 'RESOLUCION SUPREMA') 
    .replace('R.M.', 'RESOLUCION MINISTERIAL') 
    .replace('RM', 'RESOLUCION MINISTERIAL') 
    .replace('R.J.', 'RESOLUCION JEFATURAL') 
    .replace('RJ', 'RESOLUCION JEFATURAL') 
    .replace('R.D.', 'RESOLUCION DIRECTORAL') 
    .replace('RD', 'RESOLUCION DIRECTORAL') 
    .replace('Res.', 'RESOLUCION') 
    .replace('R.A.', 'RESOLUCION ADMINISTRATIVA') 
    .replace('RA', 'RESOLUCION ADMINISTRATIVA')
    .trim();
    //.replace(/^RESOLUCION DE [A-Z\s]+ N°/g, 'RESOLUCION N°')
};
