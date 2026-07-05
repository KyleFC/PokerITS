import os
from django.core.asm import get_asgi_application

# Wait, the method name is get_asgi_application, let's fix that typo.
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
application = get_asgi_application()
