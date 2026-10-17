import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { lerFichaIA, sugerirMapaIA, retomarAcessoIA } from "@/lib/ai.functions";
import { CAMPOS_FICHA, COLUNAS_IMPORTACAO } from "@/lib/ai/contracts";
import { useAuth } from "@/lib/auth";
import { usePermissoes } from "@/lib/permissoes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export function AiErro({erro,bloqueado,aoRetomar}:{erro:string;bloqueado?:boolean;aoRetomar?:()=>void}) {
 const {isAdmin}=useAuth();const retomar=useServerFn(retomarAcessoIA);const [ocupado,setOcupado]=useState(false);
 return <div role="alert" className="space-y-2 text-sm text-destructive"><p>{erro}</p>{bloqueado&&isAdmin?<Button type="button" variant="outline" disabled={ocupado} onClick={async()=>{if(!window.confirm("Confirme que o acesso ou os créditos foram restaurados antes de retomar a IA."))return;setOcupado(true);try{const r=await retomar();if(!r.ok)toast.error(r.erro);else{toast.success("Acesso retomado. Inicie uma nova solicitação.");aoRetomar?.();}}catch{toast.error("Não foi possível retomar o acesso.");}finally{setOcupado(false);}}}>Confirmar restauração do acesso</Button>:null}</div>;
}
export function LerFicha({arquivo,alunoId,caminho,edicao,aoAplicar}:{arquivo:File|null;alunoId:string|null;caminho:string|null;edicao:boolean;aoAplicar:(campos:Partial<Record<keyof typeof CAMPOS_FICHA,string>>)=>void}) {
 const permissoes=usePermissoes(); const ler=useServerFn(lerFichaIA);
 const [ocupado,setOcupado]=useState(false);const [aberto,setAberto]=useState(false);
 const [erro,setErro]=useState<{erro:string;bloqueado?:boolean}|null>(null);
 const [campos,setCampos]=useState<{campo:keyof typeof CAMPOS_FICHA;valor:string;marcado:boolean}[]>([]);
 const versao=useRef(0);
 useEffect(()=>{versao.current++;setCampos([]);setAberto(false);setErro(null);setOcupado(false);},[arquivo,caminho,alunoId]);
 if(!permissoes.pode(edicao?"editar_alunos":"cadastrar_alunos"))return null;
 async function analisar(){
  const atual=versao.current;setOcupado(true);setErro(null);setCampos([]);
  try{
   let imagem:string|null=null;
   if(arquivo){
    if(!/^image\/(jpeg|png|webp)$/.test(arquivo.type)||arquivo.size>8_000_000)throw new Error("Selecione JPG, PNG ou WebP de até 8 MB para leitura. O documento original será preservado.");
    imagem=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>typeof reader.result==="string"?resolve(reader.result):reject(new Error("Não foi possível ler o arquivo."));reader.onerror=()=>reject(new Error("Não foi possível ler o arquivo."));reader.readAsDataURL(arquivo);});
   }
   const r=await ler({data:{imagem,alunoId,edicao}});if(atual!==versao.current)return;
   if(!r.ok){setErro(r);return;}
   setCampos(r.resultado.campos.map(c=>({...c,marcado:true})));setAberto(true);
  }catch(e){if(atual===versao.current)setErro({erro:e instanceof Error?e.message:"Não foi possível ler a Ficha."});}
  finally{if(atual===versao.current)setOcupado(false);}
 }
 return <div className="space-y-2"><Button type="button" variant="outline" size="sm" disabled={ocupado||(!arquivo&&!caminho)} onClick={()=>void analisar()}>{ocupado?<LoaderCircle className="size-4 animate-spin"/>:<Sparkles className="size-4"/>}{ocupado?"Lendo ficha…":"Ler ficha com IA"}</Button><p className="text-xs text-muted-foreground">IA · Consome créditos do workspace.</p>{erro?<AiErro {...erro} aoRetomar={()=>setErro(null)}/>:null}
 <Dialog open={aberto} onOpenChange={setAberto}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Revisar dados da Ficha</DialogTitle></DialogHeader>{!campos.length?<p>Nenhum campo de cadastro foi identificado com segurança.</p>:<div className="space-y-3">{campos.map((c,i)=><div key={`${c.campo}-${i}`} className="flex items-center gap-3"><Checkbox aria-label={`Aplicar ${CAMPOS_FICHA[c.campo]}`} checked={c.marcado} onCheckedChange={v=>setCampos(s=>s.map((x,j)=>j===i?{...x,marcado:v===true}:x))}/><div className="min-w-0 flex-1 space-y-1"><Label htmlFor={`ia-ficha-${i}`}>{CAMPOS_FICHA[c.campo]}</Label><Input id={`ia-ficha-${i}`} value={c.valor} onChange={e=>setCampos(s=>s.map((x,j)=>j===i?{...x,valor:e.target.value}:x))}/></div></div>)}</div>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setAberto(false)}>Cancelar</Button><Button type="button" disabled={!campos.some(c=>c.marcado)} onClick={()=>{aoAplicar(Object.fromEntries(campos.filter(c=>c.marcado).map(c=>[c.campo,c.valor])));setAberto(false);}}>Confirmar preenchimento</Button></div></DialogContent></Dialog></div>;
}
export function MapeamentoIA({cabecalhos,atualizar,aoConfirmar,aoPendencia}:{cabecalhos:string[];atualizar:boolean;aoConfirmar:(mapa:Record<string,string>)=>void;aoPendencia:(pendente:boolean)=>void}) {
 const permissoes=usePermissoes();const sugerir=useServerFn(sugerirMapaIA); const [ocupado,setOcupado]=useState(false);const [mapa,setMapa]=useState<Record<string,string>|null>(null);const [erro,setErro]=useState<{erro:string;bloqueado?:boolean}|null>(null);const versao=useRef(0);
 useEffect(()=>{versao.current++;setMapa(null);setErro(null);setOcupado(false);},[cabecalhos,atualizar]);
 if(!permissoes.pode("cadastrar_alunos")||(atualizar&&!permissoes.pode("editar_alunos")))return null;
 return <div className="space-y-3"><Button type="button" variant="outline" disabled={ocupado} onClick={async()=>{const v=versao.current;setOcupado(true);setErro(null);aoPendencia(true);try{const r=await sugerir({data:{cabecalhos,atualizar}});if(v!==versao.current)return;if(!r.ok){setErro(r);aoPendencia(false);return;}setMapa(Object.fromEntries(r.resultado.correspondencias.map(c=>[c.cabecalho,c.campo||""])));}catch{if(v===versao.current){setErro({erro:"Não foi possível sugerir o mapeamento."});aoPendencia(false);}}finally{if(v===versao.current)setOcupado(false);}}>{ocupado?<LoaderCircle className="size-4 animate-spin"/>:<Sparkles className="size-4"/>}{ocupado?"Analisando cabeçalhos…":"Sugerir mapeamento com IA"}</Button><p className="text-xs text-muted-foreground">IA · Consome créditos do workspace.</p>{erro?<AiErro {...erro} aoRetomar={()=>setErro(null)}/>:null}{mapa?<><div className="grid gap-3 sm:grid-cols-2">{cabecalhos.map(c=><div key={c} className="space-y-1"><Label>{c}</Label><Select value={mapa[c]||"ignorar"} onValueChange={v=>setMapa(s=>({...s,[c]:v==="ignorar"?"":v}))}><SelectTrigger aria-label={`Campo para ${c}`}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="ignorar">Ignorar coluna</SelectItem>{COLUNAS_IMPORTACAO.map(col=><SelectItem key={col} value={col}>{col}</SelectItem>)}</SelectContent></Select></div>)}</div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={()=>{setMapa(null);aoPendencia(false);}}>Cancelar sugestão</Button><Button type="button" onClick={()=>{const entries=Object.entries(mapa).filter(([,v])=>v);if(new Set(entries.map(([,v])=>v)).size!==entries.length){toast.error("Associe cada campo a uma única coluna.");return;}aoConfirmar(Object.fromEntries(entries.map(([k,v])=>[v,k])));setMapa(null);aoPendencia(false);}}>Confirmar mapeamento</Button></div></>:null}</div>;
}
