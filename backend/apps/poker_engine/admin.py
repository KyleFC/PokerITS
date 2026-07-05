from django.contrib import admin
from apps.poker_engine.models import HandHistory

@admin.register(HandHistory)
class HandHistoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'pot_size', 'outcome', 'timestamp')
    list_filter = ('outcome', 'timestamp')
    search_fields = ('user__username', 'id')
