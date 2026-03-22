insert into storage.buckets (id, name, public)
values ('apk-icons', 'apk-icons', true)
on conflict (id) do nothing;

create policy "Public can view apk icons"
on storage.objects
for select
using (bucket_id = 'apk-icons');