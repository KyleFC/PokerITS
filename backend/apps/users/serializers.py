from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        # is_staff is exposed so the SPA can decide whether to render the admin
        # dashboard route and nav link. It is read-only here and purely
        # cosmetic: the admin API re-checks the flag server-side on every
        # request (see admin_analytics.permissions.IsStaffUser), so a client
        # that forges it locally gains nothing but a broken-looking page.
        fields = ('id', 'username', 'email', 'is_staff')
        read_only_fields = ('id', 'is_staff')

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, required=True,
        validators=[validate_password],  # enforce AUTH_PASSWORD_VALIDATORS on the API
        style={'input_type': 'password'},
    )
    password_confirm = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'password_confirm')

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Password fields must match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password']
        )
        return user
