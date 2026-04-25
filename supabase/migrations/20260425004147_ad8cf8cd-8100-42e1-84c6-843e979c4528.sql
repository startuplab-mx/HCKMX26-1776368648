CREATE TABLE public.chat_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL DEFAULT 'Demo session',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('minor','stranger')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.risk_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  risk_score NUMERIC NOT NULL DEFAULT 0,
  severity TEXT NOT NULL DEFAULT 'low',
  category TEXT NOT NULL DEFAULT 'benign',
  matched_patterns JSONB NOT NULL DEFAULT '[]'::jsonb,
  explanation TEXT,
  recommended_action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_events ENABLE ROW LEVEL SECURITY;

-- Demo: open read/write so the live demo works without auth.
CREATE POLICY "demo_sessions_all" ON public.chat_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "demo_messages_all" ON public.chat_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "demo_risk_events_all" ON public.risk_events FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.risk_events;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.risk_events REPLICA IDENTITY FULL;