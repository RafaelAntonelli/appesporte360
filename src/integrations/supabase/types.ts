export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      aluno_aparelhos: {
        Row: {
          aluno_id: string
          codigo_final: string | null
          codigo_hash: string | null
          consentimento_em: string | null
          created_at: string
          descricao: string | null
          id: string
          lembretes_aula: boolean
          liberado_ate: string | null
          liberado_em: string | null
          liberado_por: string | null
          liberado_por_nome: string | null
          login_salvo: boolean
          pedido_em: string
          pedido_expira_em: string
          sessao_ate: string | null
          status: string
          token_hash: string
          ultimo_acesso: string | null
        }
        Insert: {
          aluno_id: string
          codigo_final?: string | null
          codigo_hash?: string | null
          consentimento_em?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          lembretes_aula?: boolean
          liberado_ate?: string | null
          liberado_em?: string | null
          liberado_por?: string | null
          liberado_por_nome?: string | null
          login_salvo?: boolean
          pedido_em?: string
          pedido_expira_em?: string
          sessao_ate?: string | null
          status?: string
          token_hash: string
          ultimo_acesso?: string | null
        }
        Update: {
          aluno_id?: string
          codigo_final?: string | null
          codigo_hash?: string | null
          consentimento_em?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          lembretes_aula?: boolean
          liberado_ate?: string | null
          liberado_em?: string | null
          liberado_por?: string | null
          liberado_por_nome?: string | null
          login_salvo?: boolean
          pedido_em?: string
          pedido_expira_em?: string
          sessao_ate?: string | null
          status?: string
          token_hash?: string
          ultimo_acesso?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aluno_aparelhos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      aluno_push_tokens: {
        Row: {
          aluno_id: string
          aparelho_id: string
          created_at: string
          id: string
          token: string
          updated_at: string
        }
        Insert: {
          aluno_id: string
          aparelho_id: string
          created_at?: string
          id?: string
          token: string
          updated_at?: string
        }
        Update: {
          aluno_id?: string
          aparelho_id?: string
          created_at?: string
          id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aluno_push_tokens_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aluno_push_tokens_aparelho_id_fkey"
            columns: ["aparelho_id"]
            isOneToOne: false
            referencedRelation: "aluno_aparelhos"
            referencedColumns: ["id"]
          },
        ]
      }
      aluno_tentativas_acesso: {
        Row: {
          aparelho_hash: string
          created_at: string
          id: number
          rede_hash: string
        }
        Insert: {
          aparelho_hash: string
          created_at?: string
          id?: number
          rede_hash: string
        }
        Update: {
          aparelho_hash?: string
          created_at?: string
          id?: number
          rede_hash?: string
        }
        Relationships: []
      }
      alunos: {
        Row: {
          atestado_data: string | null
          atestado_entregue: boolean
          ativo: boolean
          codigo: string
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          doc_atestado_path: string | null
          doc_ficha_path: string | null
          doc_identidade_path: string | null
          doc_matricula_path: string | null
          doc_residencia_path: string | null
          email: string | null
          escola: string | null
          faixa_etaria: string | null
          foto_path: string | null
          id: string
          idade: number | null
          inativado_em: string | null
          inativado_por: string | null
          inativado_por_nome: string | null
          motivo_inativacao: string | null
          nome: string
          observacoes: string | null
          pcd: boolean
          pcd_condicoes: string[]
          pcd_descricao: string | null
          rede_ensino: string | null
          responsavel: string | null
          rg: string | null
          sexo: string | null
          telefone: string | null
          telefone2: string | null
        }
        Insert: {
          atestado_data?: string | null
          atestado_entregue?: boolean
          ativo?: boolean
          codigo?: string
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          doc_atestado_path?: string | null
          doc_ficha_path?: string | null
          doc_identidade_path?: string | null
          doc_matricula_path?: string | null
          doc_residencia_path?: string | null
          email?: string | null
          escola?: string | null
          faixa_etaria?: string | null
          foto_path?: string | null
          id?: string
          idade?: number | null
          inativado_em?: string | null
          inativado_por?: string | null
          inativado_por_nome?: string | null
          motivo_inativacao?: string | null
          nome: string
          observacoes?: string | null
          pcd?: boolean
          pcd_condicoes?: string[]
          pcd_descricao?: string | null
          rede_ensino?: string | null
          responsavel?: string | null
          rg?: string | null
          sexo?: string | null
          telefone?: string | null
          telefone2?: string | null
        }
        Update: {
          atestado_data?: string | null
          atestado_entregue?: boolean
          ativo?: boolean
          codigo?: string
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          doc_atestado_path?: string | null
          doc_ficha_path?: string | null
          doc_identidade_path?: string | null
          doc_matricula_path?: string | null
          doc_residencia_path?: string | null
          email?: string | null
          escola?: string | null
          faixa_etaria?: string | null
          foto_path?: string | null
          id?: string
          idade?: number | null
          inativado_em?: string | null
          inativado_por?: string | null
          inativado_por_nome?: string | null
          motivo_inativacao?: string | null
          nome?: string
          observacoes?: string | null
          pcd?: boolean
          pcd_condicoes?: string[]
          pcd_descricao?: string | null
          rede_ensino?: string | null
          responsavel?: string | null
          rg?: string | null
          sexo?: string | null
          telefone?: string | null
          telefone2?: string | null
        }
        Relationships: []
      }
      anotacoes_alunos: {
        Row: {
          aluno_id: string
          autor_id: string | null
          autor_nome: string | null
          created_at: string
          id: string
          texto: string
          updated_at: string
        }
        Insert: {
          aluno_id: string
          autor_id?: string | null
          autor_nome?: string | null
          created_at?: string
          id?: string
          texto: string
          updated_at?: string
        }
        Update: {
          aluno_id?: string
          autor_id?: string | null
          autor_nome?: string | null
          created_at?: string
          id?: string
          texto?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "anotacoes_alunos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      avisos: {
        Row: {
          aluno_id: string | null
          created_at: string
          enviado_por: string | null
          enviado_por_nome: string | null
          id: string
          mensagem: string
          notificados: number
          titulo: string
        }
        Insert: {
          aluno_id?: string | null
          created_at?: string
          enviado_por?: string | null
          enviado_por_nome?: string | null
          id?: string
          mensagem: string
          notificados?: number
          titulo: string
        }
        Update: {
          aluno_id?: string | null
          created_at?: string
          enviado_por?: string | null
          enviado_por_nome?: string | null
          id?: string
          mensagem?: string
          notificados?: number
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "avisos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      avisos_leituras: {
        Row: {
          aluno_id: string
          aviso_id: string
          lido_em: string
        }
        Insert: {
          aluno_id: string
          aviso_id: string
          lido_em?: string
        }
        Update: {
          aluno_id?: string
          aviso_id?: string
          lido_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "avisos_leituras_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avisos_leituras_aviso_id_fkey"
            columns: ["aviso_id"]
            isOneToOne: false
            referencedRelation: "avisos"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_cron: {
        Row: {
          ativo: boolean
          created_at: string
          dia_semana: number
          hora: number
          id: boolean
          minuto: number
          token: string
          ultimo_backup: string | null
          ultimo_resultado: string | null
          ultimo_status: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dia_semana?: number
          hora?: number
          id?: boolean
          minuto?: number
          token?: string
          ultimo_backup?: string | null
          ultimo_resultado?: string | null
          ultimo_status?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dia_semana?: number
          hora?: number
          id?: boolean
          minuto?: number
          token?: string
          ultimo_backup?: string | null
          ultimo_resultado?: string | null
          ultimo_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      backup_historico: {
        Row: {
          concluido_em: string | null
          enviados: number
          falhas: Json
          id: string
          iniciado_em: string
          planilha_id: string | null
          planilha_nome: string | null
          resumo: string | null
          status: string
          tipo: string
          total: number
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          concluido_em?: string | null
          enviados?: number
          falhas?: Json
          id?: string
          iniciado_em?: string
          planilha_id?: string | null
          planilha_nome?: string | null
          resumo?: string | null
          status?: string
          tipo?: string
          total?: number
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          concluido_em?: string | null
          enviados?: number
          falhas?: Json
          id?: string
          iniciado_em?: string
          planilha_id?: string | null
          planilha_nome?: string | null
          resumo?: string | null
          status?: string
          tipo?: string
          total?: number
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: []
      }
      configuracoes: {
        Row: {
          chave: string
          created_at: string
          updated_at: string
          valor: string
        }
        Insert: {
          chave: string
          created_at?: string
          updated_at?: string
          valor: string
        }
        Update: {
          chave?: string
          created_at?: string
          updated_at?: string
          valor?: string
        }
        Relationships: []
      }
      desbloqueios_permissoes: {
        Row: {
          created_at: string
          user_id: string
          valido_ate: string
        }
        Insert: {
          created_at?: string
          user_id: string
          valido_ate: string
        }
        Update: {
          created_at?: string
          user_id?: string
          valido_ate?: string
        }
        Relationships: []
      }
      fila_espera: {
        Row: {
          created_at: string
          id: string
          idade: number | null
          modalidade: string
          nome: string
          observacoes: string | null
          pcd: boolean
          pcd_condicoes: string[]
          pcd_descricao: string | null
          preferencia_horario: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          idade?: number | null
          modalidade?: string
          nome: string
          observacoes?: string | null
          pcd?: boolean
          pcd_condicoes?: string[]
          pcd_descricao?: string | null
          preferencia_horario?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          idade?: number | null
          modalidade?: string
          nome?: string
          observacoes?: string | null
          pcd?: boolean
          pcd_condicoes?: string[]
          pcd_descricao?: string | null
          preferencia_horario?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      grupos_dias: {
        Row: {
          created_at: string
          dias: string[]
          id: string
          label: string
          ordem: number
        }
        Insert: {
          created_at?: string
          dias?: string[]
          id?: string
          label: string
          ordem?: number
        }
        Update: {
          created_at?: string
          dias?: string[]
          id?: string
          label?: string
          ordem?: number
        }
        Relationships: []
      }
      horarios: {
        Row: {
          created_at: string
          horario: string
          id: string
          ordem: number
        }
        Insert: {
          created_at?: string
          horario: string
          id?: string
          ordem?: number
        }
        Update: {
          created_at?: string
          horario?: string
          id?: string
          ordem?: number
        }
        Relationships: []
      }
      ia_acesso: {
        Row: {
          atualizado_em: string
          bloqueado: boolean
          id: boolean
          motivo: string | null
        }
        Insert: {
          atualizado_em?: string
          bloqueado?: boolean
          id?: boolean
          motivo?: string | null
        }
        Update: {
          atualizado_em?: string
          bloqueado?: boolean
          id?: boolean
          motivo?: string | null
        }
        Relationships: []
      }
      lembretes_aula_enviados: {
        Row: {
          antecedencia: number
          celulares: number
          created_at: string
          data: string
          enviados: number
          id: string
          turma_id: string
        }
        Insert: {
          antecedencia: number
          celulares?: number
          created_at?: string
          data: string
          enviados?: number
          id?: string
          turma_id: string
        }
        Update: {
          antecedencia?: number
          celulares?: number
          created_at?: string
          data?: string
          enviados?: number
          id?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lembretes_aula_enviados_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      licencas_medicas: {
        Row: {
          aluno_id: string
          anexo_path: string | null
          concluida_em: string | null
          concluida_por: string | null
          created_at: string
          data_inicio: string
          data_retorno: string
          id: string
          liberacao_path: string | null
          motivo: string | null
          registrado_por: string | null
          status: string
        }
        Insert: {
          aluno_id: string
          anexo_path?: string | null
          concluida_em?: string | null
          concluida_por?: string | null
          created_at?: string
          data_inicio?: string
          data_retorno: string
          id?: string
          liberacao_path?: string | null
          motivo?: string | null
          registrado_por?: string | null
          status?: string
        }
        Update: {
          aluno_id?: string
          anexo_path?: string | null
          concluida_em?: string | null
          concluida_por?: string | null
          created_at?: string
          data_inicio?: string
          data_retorno?: string
          id?: string
          liberacao_path?: string | null
          motivo?: string | null
          registrado_por?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "licencas_medicas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      matriculas: {
        Row: {
          aluno_id: string
          created_at: string
          data_inicio: string
          id: string
          modalidade: string
          plano: string
          registrado_por: string | null
          registrado_por_nome: string | null
          status: string
          turma_id: string
          valor_mensal: number
        }
        Insert: {
          aluno_id: string
          created_at?: string
          data_inicio?: string
          id?: string
          modalidade?: string
          plano?: string
          registrado_por?: string | null
          registrado_por_nome?: string | null
          status?: string
          turma_id: string
          valor_mensal?: number
        }
        Update: {
          aluno_id?: string
          created_at?: string
          data_inicio?: string
          id?: string
          modalidade?: string
          plano?: string
          registrado_por?: string | null
          registrado_por_nome?: string | null
          status?: string
          turma_id?: string
          valor_mensal?: number
        }
        Relationships: [
          {
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      permissoes_professor: {
        Row: {
          ativo: boolean
          chave: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          chave: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          chave?: string
          updated_at?: string
        }
        Relationships: []
      }
      presencas: {
        Row: {
          aluno_id: string
          created_at: string
          data: string
          horario: string
          id: string
          metodo: string
          observacoes: string | null
          registrado_por: string | null
          registrado_por_nome: string | null
          status: string
          turma_id: string | null
        }
        Insert: {
          aluno_id: string
          created_at?: string
          data?: string
          horario?: string
          id?: string
          metodo?: string
          observacoes?: string | null
          registrado_por?: string | null
          registrado_por_nome?: string | null
          status?: string
          turma_id?: string | null
        }
        Update: {
          aluno_id?: string
          created_at?: string
          data?: string
          horario?: string
          id?: string
          metodo?: string
          observacoes?: string | null
          registrado_por?: string | null
          registrado_por_nome?: string | null
          status?: string
          turma_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presencas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      professor_turmas: {
        Row: {
          created_at: string
          id: string
          turma_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          turma_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          turma_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professor_turmas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          foto_path: string | null
          id: string
          nome: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          foto_path?: string | null
          id: string
          nome?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          foto_path?: string | null
          id?: string
          nome?: string | null
        }
        Relationships: []
      }
      turmas: {
        Row: {
          ativa: boolean
          capacidade: number
          created_at: string
          dias_semana: string[]
          horario: string | null
          id: string
          modalidade: string
          nome: string
          professor: string | null
          turno: string | null
        }
        Insert: {
          ativa?: boolean
          capacidade?: number
          created_at?: string
          dias_semana?: string[]
          horario?: string | null
          id?: string
          modalidade?: string
          nome: string
          professor?: string | null
          turno?: string | null
        }
        Update: {
          ativa?: boolean
          capacidade?: number
          created_at?: string
          dias_semana?: string[]
          horario?: string | null
          id?: string
          modalidade?: string
          nome?: string
          professor?: string | null
          turno?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      agendar_backup: {
        Args: { _ativo: boolean; _dia: number; _hora: number; _minuto: number }
        Returns: undefined
      }
      buscar_pedido_aparelho: { Args: { _codigo: string }; Returns: string }
      calc_faixa_etaria: {
        Args: { _idade: number; _nascimento: string }
        Returns: string
      }
      calc_turno: { Args: { _horario: string }; Returns: string }
      disparar_backup_semanal: { Args: never; Returns: undefined }
      gerar_codigo_matricula: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      liberar_aparelho_aluno: { Args: { _id: string }; Returns: undefined }
      localizar_aluno_acesso: {
        Args: { _identificador: string; _nascimento: string }
        Returns: {
          ativo: boolean
          id: string
        }[]
      }
      nome_usuario: { Args: { _id: string }; Returns: string }
      permissoes_desbloqueadas: { Args: { _user_id: string }; Returns: boolean }
      pode: { Args: { _permissao: string; _user_id: string }; Returns: boolean }
      recusar_aparelho_aluno: { Args: { _id: string }; Returns: undefined }
      revogar_aparelho_aluno: { Args: { _id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "professor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "professor"],
    },
  },
} as const
