"""Access control for the instructor/researcher dashboard.

Admin status is ``User.is_staff`` — the flag Django's ``AbstractUser`` already
carries — rather than a parallel account model. One user table, one login, one
JWT; the dashboard is a different *view* of the same identity, not a different
kind of account. Create one with ``manage.py createsuperuser`` (or by flipping
``is_staff`` in Django admin).

This class is the only thing that actually protects the data. The SPA also hides
the admin route from non-staff users, but that is a convenience for the UI: the
JWT is client-side and the endpoints are reachable directly, so authorization
must be re-decided here on every request.
"""
from rest_framework import permissions


class IsStaffUser(permissions.BasePermission):
    """Allow only authenticated users with ``is_staff`` set."""

    message = 'Administrator access required.'

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_staff)


class IsStaffReadOnly(IsStaffUser):
    """Staff-only *and* read-only.

    The dashboard is an analysis surface: it reads the student model, it never
    edits it. Grading, mastery updates, and hand results stay owned by the
    endpoints that produce them, so a stray write from here can't corrupt the
    data the ITS reasons about. Endpoints that legitimately mutate (e.g. pruning
    abandoned rows) opt out by using ``IsStaffUser`` instead.
    """

    def has_permission(self, request, view):
        if request.method not in permissions.SAFE_METHODS:
            return False
        return super().has_permission(request, view)
