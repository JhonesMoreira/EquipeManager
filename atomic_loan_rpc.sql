-- ==========================================
-- SCRIPT PARA EMPRÉSTIMO ATÔMICO (ANTI-CONCORRÊNCIA)
-- ==========================================
-- Copie e cole este código no SQL Editor do seu Dashboard Supabase.

-- IMPORTANTE: Limpar versões anteriores para evitar erro de "Ambigous Function"
DROP FUNCTION IF EXISTS realizar_emprestimo(text, text, text, text, timestamptz, date, date, text, jsonb, text, text);
DROP FUNCTION IF EXISTS realizar_emprestimo(text, text, text, text, timestamptz, date, date, text, jsonb, text, text, text);

CREATE OR REPLACE FUNCTION realizar_emprestimo(
  p_usuario_id TEXT,
  p_usuario_nome TEXT,
  p_email TEXT,
  p_depto TEXT,
  p_data TIMESTAMPTZ,
  p_data_retirada DATE,
  p_data_prevista DATE,
  p_finalidade TEXT,
  p_itens JSONB,
  p_terceiro_nome TEXT DEFAULT NULL,
  p_terceiro_cpf TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_item_record JSONB;
  v_item_id INT;
  v_loan_id INT;
BEGIN
  -- 1. Verificar se todos os itens estão disponíveis
  -- Se um usuário tentar pegar algo que acabou de ser pego, o banco travará aqui.
  FOR v_item_record IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_item_id := (v_item_record->>'id')::INT;
    
    -- O 'FOR UPDATE' garante que ninguém mexa nessa linha enquanto esta função roda
    IF NOT EXISTS (
      SELECT 1 FROM equipamentos 
      WHERE id = v_item_id AND status = 'available' 
      FOR UPDATE
    ) THEN
      RAISE EXCEPTION 'O item % não está mais disponível.', (v_item_record->>'nome');
    END IF;
  END LOOP;

  -- 2. Inserir o empréstimo
  INSERT INTO emprestimos (
    usuario_id, usuario_nome, email, depto, data, data_retirada, 
    data_prevista, finalidade, itens, terceiro_nome, terceiro_cpf, 
    status
  ) VALUES (
    p_usuario_id, p_usuario_nome, p_email, p_depto, p_data, p_data_retirada, 
    p_data_prevista, p_finalidade, p_itens, p_terceiro_nome, p_terceiro_cpf, 
    'active'
  ) RETURNING id INTO v_loan_id;

  -- 3. Atualizar status dos equipamentos para 'in_use'
  FOR v_item_record IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    UPDATE equipamentos SET status = 'in_use' WHERE id = (v_item_record->>'id')::INT;
  END LOOP;

  -- Retornar os dados do empréstimo criado para o App
  RETURN (SELECT row_to_json(e)::jsonb FROM emprestimos e WHERE id = v_loan_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- FIM DO SCRIPT
-- ==========================================
