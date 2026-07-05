from django.urls import path
from apps.student_model.views import StudentProfileView, QuizResultView, SkillHistoryView

urlpatterns = [
    path('profile/', StudentProfileView.as_view(), name='student_profile'),
    path('quiz-result/', QuizResultView.as_view(), name='quiz_result'),
    path('history/', SkillHistoryView.as_view(), name='skill_history'),
]
