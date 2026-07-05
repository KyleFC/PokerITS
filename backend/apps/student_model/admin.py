from django.contrib import admin
from apps.student_model.models import StudentProfile
from apps.student_model.observations import SkillObservation

@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'skills', 'updated_at')
    search_fields = ('user__username', 'user__email')

@admin.register(SkillObservation)
class SkillObservationAdmin(admin.ModelAdmin):
    list_display = ('user', 'skill', 'correct', 'posterior_after', 'source', 'timestamp')
    list_filter = ('skill', 'correct', 'source')
    search_fields = ('user__username',)
