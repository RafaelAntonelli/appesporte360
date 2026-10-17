import { DIMENSOES, type Dimensao, type PlanoRelatorio } from "./contracts";
import { normalizarTexto } from "@/lib/formatacao";
import { turnoDoHorario } from "@/lib/turnos";

export type AlunoAgregado = {id:string; ativo:boolean|null; sexo:string|null; faixa_etaria:string|null; data_nascimento:string|null; idade:number|null; pcd:boolean|null; rede_ensino:string|null; escola:string|null};
export type MatriculaAgregada = {id:string; aluno_id:string; turma_id:string; modalidade:string|null; status:string};
export type TurmaAgregada = {id:string; modalidade:string|null; horario:string|null; dias_semana:string[]|null};
const DIAS:Record<string,string> = {Seg:"Segunda",Ter:"Terça",Qua:"Quarta",Qui:"Quinta",Sex:"Sexta",Sab:"Sábado",Dom:"Domingo"};
export function idadeValida(a:Pick<AlunoAgregado,"data_nascimento"|"idade">, hoje:string):number|null {
  if (a.data_nascimento) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.data_nascimento)) return null;
    const d = new Date(`${a.data_nascimento}T00:00:00Z`);
    if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10) !== a.data_nascimento || a.data_nascimento > hoje) return null;
    let idade = Number(hoje.slice(0,4))-Number(a.data_nascimento.slice(0,4));
    if (hoje.slice(5)<a.data_nascimento.slice(5)) idade--;
    return idade>=0 && idade<=120 ? idade : null;
  }
  return typeof a.idade === "number" && Number.isInteger(a.idade) && a.idade>=0 && a.idade<=120 ? a.idade : null;
}
function faixa(idade:number|null, registrada:string|null) {
  if(idade===null) return registrada || "Não informado";
  return idade<12?"Criança":idade<18?"Adolescente":idade<60?"Adulto":"Idoso";
}
function dimensoes(a:AlunoAgregado,m:MatriculaAgregada|undefined,t:TurmaAgregada|undefined, hoje:string):Record<Dimensao,string> {
  return {situacao:a.ativo===false?"Inativos":"Ativos",sexo:a.sexo||"Não informado",faixa:faixa(idadeValida(a,hoje),a.faixa_etaria),pcd:a.pcd?"Sim":"Não",rede_ensino:a.rede_ensino||"Não informado",escola:a.escola||"Não informado",modalidade:m?.modalidade||t?.modalidade||"Sem matrícula ativa",horario:t?.horario||"Não informado",dias:(t?.dias_semana||[]).map(d=>DIAS[d]||d).join(" e ")||"Não informado",turno:turnoDoHorario(t?.horario)||"Não informado"};
}
const DE_MATRICULA = new Set<Dimensao>(["modalidade","horario","dias","turno"]);
export function catalogoRelatorio(alunos:AlunoAgregado[],matriculas:MatriculaAgregada[],turmas:TurmaAgregada[],hoje:string) {
  const sets = Object.fromEntries(DIMENSOES.map(d=>[d,new Set<string>()])) as Record<Dimensao,Set<string>>;
  const porTurma = new Map(turmas.map(t=>[t.id,t]));
  const porAluno = new Map<string,MatriculaAgregada[]>();
  for(const m of matriculas) if(m.status==="ativa") porAluno.set(m.aluno_id,[...(porAluno.get(m.aluno_id)||[]),m]);
  for(const a of alunos) for(const m of porAluno.get(a.id)||[undefined]) {
    const valores=dimensoes(a,m,m?porTurma.get(m.turma_id):undefined,hoje);
    for(const d of DIMENSOES) sets[d].add(valores[d]);
  }
  return Object.fromEntries(DIMENSOES.map(d=>[d,[...sets[d]].sort()])) as Record<Dimensao,string[]>;
}
export function validarPlano(plano:PlanoRelatorio,catalogo:Record<Dimensao,string[]>):PlanoRelatorio {
  for(const f of plano.filtros) {
    if(!f.valores.length) throw new Error("O filtro sugerido está vazio. Reformule a pergunta.");
    for(let i=0;i<f.valores.length;i++) {
      const valor=f.valores[i];
      const real=catalogo[f.campo].find(v=>normalizarTexto(v)===normalizarTexto(valor));
      if(!real) throw new Error(`Não existe a opção ${valor} para ${f.campo} nos registros autorizados.`);
      f.valores[i]=real;
    }
  }
  for(const valor of [plano.idadeMin,plano.idadeMax]) if(valor!==null && (!Number.isInteger(valor)||valor<0||valor>120)) throw new Error("Limite de idade inválido.");
  if(plano.idadeMin!==null && plano.idadeMax!==null && plano.idadeMin>plano.idadeMax) throw new Error("Intervalo de idade inválido.");
  return {...plano,grupos:[...new Set(plano.grupos)]};
}
function estatisticas(pessoas:AlunoAgregado[],totalBase:number,hoje:string) {
  const idades=pessoas.map(a=>idadeValida(a,hoje)).filter((i):i is number=>i!==null).sort((a,b)=>a-b);
  const n=idades.length; const meio=Math.floor(n/2);
  return {total:pessoas.length,percentual:totalBase?100*pessoas.length/totalBase:0,comIdadeValida:n,semIdadeValida:pessoas.length-n,media:n?idades.reduce((a,b)=>a+b,0)/n:null,mediana:n? n%2?idades[meio]??null:((idades[meio-1]??0)+(idades[meio]??0))/2:null,minima:idades[0]??null,maxima:idades[n-1]??null};
}
export function calcularRelatorio(alunos:AlunoAgregado[],matriculas:MatriculaAgregada[],turmas:TurmaAgregada[],plano:PlanoRelatorio,hoje:string) {
  const porTurma=new Map(turmas.map(t=>[t.id,t])); const porAluno=new Map<string,MatriculaAgregada[]>();
  for(const m of matriculas) if(m.status==="ativa") porAluno.set(m.aluno_id,[...(porAluno.get(m.aluno_id)||[]),m]);
  const selecionados=new Map<string,AlunoAgregado>(); const grupos=new Map<string,Map<string,AlunoAgregado>>();
  for(const a of alunos) {
    const idade=idadeValida(a,hoje);
    if((plano.idadeMin!==null && (idade===null||idade<plano.idadeMin)) || (plano.idadeMax!==null&&(idade===null||idade>plano.idadeMax))) continue;
    const ms=porAluno.get(a.id)||[];
    const exigeMatricula=plano.filtros.some(f=>DE_MATRICULA.has(f.campo));
    for(const m of ms.length?ms:exigeMatricula?[]:[undefined]) {
      const valores=dimensoes(a,m,m?porTurma.get(m.turma_id):undefined,hoje);
      if(!plano.filtros.every(f=>f.valores.includes(valores[f.campo]))) continue;
      selecionados.set(a.id,a);
      const chave=JSON.stringify(plano.grupos.map(g=>valores[g]));
      if(!grupos.has(chave)) grupos.set(chave,new Map());
      grupos.get(chave)?.set(a.id,a);
    }
  }
  const total=selecionados.size;
  return {dataReferencia:hoje,baseAutorizada:alunos.length,resumo:estatisticas([...selecionados.values()],total,hoje),grupos:[...grupos].map(([chave,pessoas])=>({valores:JSON.parse(chave) as string[],...estatisticas([...pessoas.values()],total,hoje)})),nota:"Cada aluno conta uma vez por grupo. Um aluno pode participar de grupos diferentes; a soma dos grupos pode exceder o total. Percentuais usam o total de alunos selecionados como denominador."};
}

/** Paginação por chave única: continua mesmo se o serviço devolver menos de 500 linhas. */
export async function lerTodasPaginas<T extends {id:string}>(ler:(apos:string|null)=>Promise<T[]>):Promise<T[]> {
  const todas:T[]=[]; let apos:string|null=null;
  while(true) {const pagina=await ler(apos); if(!pagina.length) break; const ultima=pagina.at(-1)?.id; if(!ultima||ultima===apos) throw new Error("Paginação sem avanço."); todas.push(...pagina); apos=ultima;}
  return todas;
}
