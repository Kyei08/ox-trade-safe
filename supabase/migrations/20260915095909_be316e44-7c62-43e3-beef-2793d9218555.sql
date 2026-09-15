create or replace function public.get_seller_verification_proof(_seller_id uuid)
returns table (
  seller_type seller_type,
  verified_at timestamptz,
  company_name text,
  document_keys text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    sv.seller_type,
    sv.reviewed_at,
    case when sv.seller_type = 'business' then sv.company_name else null end,
    coalesce((
      select array_agg(distinct d.field_key order by d.field_key)
      from public.seller_verification_documents d
      where d.verification_id = sv.id and d.is_current
    ), '{}'::text[])
  from public.seller_verifications sv
  where sv.user_id = _seller_id
    and sv.status = 'approved'
  order by sv.reviewed_at desc nulls last
  limit 1
$$;

grant execute on function public.get_seller_verification_proof(uuid) to anon, authenticated;