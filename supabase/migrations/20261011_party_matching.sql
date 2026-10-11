-- Run this once in the Supabase SQL editor for an existing MooMate database.
alter table matches add column if not exists anchor text not null default '';
alter table matches add column if not exists icebreaker text not null default '';
alter table participants add column if not exists access_token_hash text;

-- A room lock and a single transaction prevent repeated host clicks from matching a player twice.
create or replace function persist_party_pair(
  p_room_id uuid,
  p_a uuid,
  p_b uuid,
  p_score numeric,
  p_reason text,
  p_anchor text,
  p_icebreaker text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id uuid;
  v_ready integer;
begin
  perform 1 from rooms where id = p_room_id and status = 'active' for update;
  if not found then raise exception '房间不可匹配'; end if;
  if p_a = p_b or p_score < 60 or p_score > 100 then raise exception '匹配参数无效'; end if;
  select count(*) into v_ready from participants
    where id in (p_a, p_b) and room_id = p_room_id
      and status = 'waiting' and match_id is null
      and answers is not null and answers ? 'q1' and answers ? 'q2' and answers ? 'q5';
  if v_ready <> 2 then raise exception '参与者已退出或已匹配'; end if;
  insert into matches (room_id, participant_a, participant_b, score, reason, anchor, icebreaker)
    values (p_room_id, p_a, p_b, p_score, p_reason, p_anchor, p_icebreaker)
    returning id into v_match_id;
  update participants set status = 'matched', match_id = v_match_id where id in (p_a, p_b);
  return v_match_id;
end;
$$;

revoke all on function persist_party_pair(uuid, uuid, uuid, numeric, text, text, text) from public, anon, authenticated;
grant execute on function persist_party_pair(uuid, uuid, uuid, numeric, text, text, text) to service_role;
