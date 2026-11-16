drop policy if exists terminal_report_verifications_public_select
  on terminal_report_verifications;

create policy terminal_report_verifications_public_select
  on terminal_report_verifications for select
  to public
  using (token = nullif(current_setting('app.public_report_token', true), ''));
