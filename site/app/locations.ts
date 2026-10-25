export const locations:Record<string,{label:string;places:string[];directTitle?:string}> = {
 banks:{label:'Bancos',places:['Banco de Saint Denis','Banco de Rhodes','Banco de Armadillo','Banco de Valentine','Banco de Blackwater']},
 stations:{label:'Estações',places:['Estação de Rhodes','Estação de Valentine','Estação de Annesburg','Estação de Blackwater','Estação de Riggs','Estação de Flatneck','Estação de Armadillo']},
 oil:{label:'Petrolífera',places:[],directTitle:'Petrolífera Cornwall'},
 burned_city:{label:'Cidade Queimada',places:[],directTitle:'Cidade Queimada'},
 stores:{label:'Lojinhas',places:['Lojinha de Saint Denis','Lojinha de Rhodes','Lojinha de Blackwater','Lojinha de Strawberry']},
 other:{label:'Outras ações',places:[]},
};
export function actionSection(category:string,title:string){
 return /cidade\s*queimada/i.test(title)?'burned_city':category;
}
