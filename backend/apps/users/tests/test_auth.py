import pytest
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

User = get_user_model()

@pytest.mark.django_db
class TestAuthentication:
    @pytest.fixture(autouse=True)
    def setup_method(self):
        self.client = APIClient()
        self.register_url = reverse('register')
        self.login_url = reverse('token_obtain_pair')
        self.me_url = reverse('me')

    def test_registration_success(self):
        payload = {
            'username': 'testplayer',
            'email': 'test@example.com',
            'password': 'StrongPassword123!',
            'password_confirm': 'StrongPassword123!'
        }
        response = self.client.post(self.register_url, payload)
        assert response.status_code == status.HTTP_201_CREATED
        assert User.objects.filter(username='testplayer').exists()
        
        # Verify student profile was created automatically via signal
        user = User.objects.get(username='testplayer')
        assert hasattr(user, 'student_profile')
        assert user.student_profile.skills['preflop_range'] == 0.30

    def test_registration_rejects_weak_password(self):
        payload = {
            'username': 'weakling',
            'email': 'weak@example.com',
            'password': 'abc',
            'password_confirm': 'abc',
        }
        response = self.client.post(self.register_url, payload)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'password' in response.data
        assert not User.objects.filter(username='weakling').exists()

    def test_registration_password_mismatch(self):
        payload = {
            'username': 'testplayer',
            'email': 'test@example.com',
            'password': 'StrongPassword123!',
            'password_confirm': 'DifferentPassword123!'
        }
        response = self.client.post(self.register_url, payload)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'password' in response.data

    def test_login_and_retrieve_profile(self):
        # Create user
        user = User.objects.create_user(username='loginplayer', password='Password123!')
        
        # Login to get JWT tokens
        login_payload = {
            'username': 'loginplayer',
            'password': 'Password123!'
        }
        response = self.client.post(self.login_url, login_payload)
        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data
        assert 'refresh' in response.data
        
        # Access current user profile using JWT token
        token = response.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        profile_response = self.client.get(self.me_url)
        assert profile_response.status_code == status.HTTP_200_OK
        assert profile_response.data['username'] == 'loginplayer'

    def test_access_profile_unauthorized(self):
        response = self.client.get(self.me_url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
