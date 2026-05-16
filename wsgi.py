"""WSGI entry point untuk gunicorn / Vercel / hosting lain."""

from app import create_app

app = create_app()
