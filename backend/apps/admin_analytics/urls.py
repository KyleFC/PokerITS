from django.urls import path

from apps.admin_analytics import views

app_name = 'admin_analytics'

urlpatterns = [
    path('overview/', views.AdminOverviewView.as_view(), name='overview'),
    path('users/', views.AdminUserListView.as_view(), name='user-list'),
    path('users/<int:user_id>/', views.AdminUserDetailView.as_view(), name='user-detail'),
    path('items/', views.AdminItemAnalysisView.as_view(), name='item-analysis'),
    path('curves/', views.AdminLearningCurvesView.as_view(), name='learning-curves'),
    path('health/', views.AdminHealthView.as_view(), name='health'),
    path('export/', views.AdminExportView.as_view(), name='export'),
]
