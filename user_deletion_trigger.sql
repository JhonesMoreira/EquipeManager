-- ==========================================
-- SCRIPT DE SINCRONIZAÇÃO DE DELEÇÃO
-- ==========================================
-- Copie e cole este código no SQL Editor do seu Dashboard Supabase.
-- Isso garantirá que ao deletar da "Table Editor" (ou via App), 
-- o usuário também suma do "Authentication".

-- 1. Cria uma função que roda com privilégios de administrador (SECURITY DEFINER)
-- para conseguir deletar da tabela interna de Auth.
CREATE OR REPLACE FUNCTION public.handle_user_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Deleta o usuário do Supabase Authentication usando o ID da linha removida
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Cria o Gatilho (Trigger) na tabela 'usuarios'
-- O comando DROP garante que não teremos erros se você rodar o script mais de uma vez.
DROP TRIGGER IF EXISTS on_user_profile_deleted ON public.usuarios;
CREATE TRIGGER on_user_profile_deleted
  AFTER DELETE ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_delete();

-- ==========================================
-- FIM DO SCRIPT
-- ==========================================
