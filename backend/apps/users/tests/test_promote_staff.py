"""The promote_staff command, which is how instructor access is granted on a
hosted deployment where no interactive shell is available."""
import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from io import StringIO

User = get_user_model()


def run(*args, **kwargs):
    out = StringIO()
    call_command('promote_staff', *args, stdout=out, stderr=out, **kwargs)
    return out.getvalue()


@pytest.fixture
def student(db):
    return User.objects.create_user(username='alice', password='pw-alice-123!')


def test_promotes_an_existing_user(student):
    output = run('alice')
    student.refresh_from_db()
    assert student.is_staff is True
    assert 'Promoted alice' in output


def test_is_idempotent(student):
    run('alice')
    output = run('alice')
    student.refresh_from_db()
    assert student.is_staff is True
    assert 'already staff' in output


def test_revoke_removes_access(student):
    run('alice')
    output = run('alice', '--revoke')
    student.refresh_from_db()
    assert student.is_staff is False
    assert 'Demoted alice' in output


def test_unknown_user_warns_without_failing(db):
    """A typo must not fail a deploy — the build command runs this unattended."""
    output = run('nobody')
    assert 'No such user: nobody' in output


def test_strict_mode_raises_for_unknown_user(db):
    with pytest.raises(CommandError):
        run('nobody', '--strict')


def test_reads_usernames_from_the_env_var(student, monkeypatch):
    monkeypatch.setenv('STAFF_USERNAMES', 'alice')
    run()
    student.refresh_from_db()
    assert student.is_staff is True


def test_env_var_accepts_commas_and_whitespace(db, monkeypatch):
    for name in ('alice', 'bob', 'carol'):
        User.objects.create_user(username=name, password='pw-user-1234!')
    monkeypatch.setenv('STAFF_USERNAMES', 'alice, bob  carol')
    run()
    assert set(
        User.objects.filter(is_staff=True).values_list('username', flat=True)
    ) == {'alice', 'bob', 'carol'}


def test_explicit_arguments_override_the_env_var(db, monkeypatch):
    User.objects.create_user(username='bob', password='pw-bob-12345!')
    student = User.objects.create_user(username='alice', password='pw-alice-123!')
    monkeypatch.setenv('STAFF_USERNAMES', 'bob')
    run('alice')
    student.refresh_from_db()
    assert student.is_staff is True
    assert User.objects.get(username='bob').is_staff is False


def test_no_usernames_anywhere_is_a_harmless_noop(db, monkeypatch):
    monkeypatch.delenv('STAFF_USERNAMES', raising=False)
    output = run()
    assert 'nothing to do' in output
    assert not User.objects.filter(is_staff=True).exists()


def test_promoting_does_not_touch_other_fields(student):
    """update_fields keeps the command from clobbering a concurrent write."""
    original_email = student.email
    original_password = student.password
    run('alice')
    student.refresh_from_db()
    assert student.email == original_email
    assert student.password == original_password


def test_list_reports_staff_without_changing_anything(student):
    output = run('--list')
    student.refresh_from_db()
    assert student.is_staff is False
    assert 'Staff accounts: none.' in output
