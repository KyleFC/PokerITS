from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Token Authentication
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # App routers/endpoints
    path('api/auth/', include('apps.users.urls')),
    path('api/student/', include('apps.student_model.urls')),
    path('api/poker/', include('apps.poker_engine.urls')),
    # Instructor/researcher dashboard. Every view inside is gated on
    # User.is_staff (apps.admin_analytics.permissions.IsStaffUser).
    path('api/admin/', include('apps.admin_analytics.urls')),
]
