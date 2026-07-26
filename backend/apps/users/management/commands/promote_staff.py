"""Grant or revoke instructor-dashboard access on a deployed instance.

``is_staff`` is what gates the instructor console (see
``admin_analytics.permissions.IsStaffUser``), and on a hosted deployment there is
often no interactive shell to flip it in — Render's Shell tab is a paid feature.
So this command is written to be safe to run unattended from a build or
pre-deploy step:

    python manage.py promote_staff                  # reads STAFF_USERNAMES
    python manage.py promote_staff alice bob        # explicit
    python manage.py promote_staff alice --revoke   # take it away

**No password is ever involved.** The account is created the normal way — the
student/instructor signs up through the app's own registration page — and this
command only raises the flag on an account that already exists. That keeps
credentials out of the environment entirely, which matters because Render
environment variables are readable by anyone with dashboard access.

Idempotent and non-fatal by design: promoting an already-staff user is a no-op,
and an unknown username warns rather than raising. A management command that
exits non-zero from a build command fails the whole deploy, and locking yourself
out of a deploy over a typo in a username is a worse outcome than a warning in
the build log. Pass ``--strict`` when you want the mismatch to be an error.
"""
import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

User = get_user_model()

ENV_VAR = 'STAFF_USERNAMES'


class Command(BaseCommand):
    help = (
        'Grant (or revoke) is_staff — instructor dashboard access — for existing '
        f'accounts. Usernames come from arguments or the {ENV_VAR} env var.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            'usernames', nargs='*',
            help=f'Usernames to promote. Falls back to the {ENV_VAR} env var '
                 '(comma- or space-separated) when omitted.',
        )
        parser.add_argument(
            '--revoke', action='store_true',
            help='Remove is_staff instead of granting it.',
        )
        parser.add_argument(
            '--strict', action='store_true',
            help='Exit non-zero if any username does not exist. Off by default '
                 'so a typo cannot fail a deploy.',
        )
        parser.add_argument(
            '--list', action='store_true',
            help='List current staff accounts and make no changes.',
        )

    def handle(self, *args, **options):
        if options['list']:
            self._list_staff()
            return

        usernames = self._resolve_usernames(options['usernames'])
        if not usernames:
            self.stdout.write(self.style.WARNING(
                f'No usernames given and {ENV_VAR} is unset — nothing to do.'
            ))
            return

        grant = not options['revoke']
        verb = 'Promoted' if grant else 'Demoted'
        changed, unchanged, missing = [], [], []

        for username in usernames:
            user = User.objects.filter(username=username).first()
            if user is None:
                missing.append(username)
                continue
            if user.is_staff == grant:
                unchanged.append(username)
                continue
            user.is_staff = grant
            # update_fields keeps this to the one column, so the command can
            # never clobber a concurrent write to the rest of the row.
            user.save(update_fields=['is_staff'])
            changed.append(username)

        for username in changed:
            self.stdout.write(self.style.SUCCESS(f'{verb} {username}.'))
        for username in unchanged:
            state = 'already staff' if grant else 'already not staff'
            self.stdout.write(f'{username}: {state}, no change.')
        for username in missing:
            self.stdout.write(self.style.WARNING(
                f'No such user: {username}. Have them register through the app '
                'first, then re-run this command.'
            ))

        if missing and options['strict']:
            raise CommandError(f'{len(missing)} username(s) not found.')

        self._list_staff()

    def _resolve_usernames(self, argv_usernames):
        """Explicit arguments win; otherwise read the env var.

        The env var accepts commas or whitespace because both get typed into a
        dashboard field, and silently ignoring one of them would look like the
        command simply didn't work.
        """
        if argv_usernames:
            return list(dict.fromkeys(argv_usernames))
        raw = os.getenv(ENV_VAR, '')
        parts = [p.strip() for p in raw.replace(',', ' ').split()]
        return list(dict.fromkeys(p for p in parts if p))

    def _list_staff(self):
        staff = list(
            User.objects.filter(is_staff=True)
            .order_by('username')
            .values_list('username', flat=True)
        )
        if staff:
            self.stdout.write(
                f'Staff accounts ({len(staff)}): {", ".join(staff)}'
            )
        else:
            self.stdout.write('Staff accounts: none.')
