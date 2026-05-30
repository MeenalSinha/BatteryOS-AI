FROM python:3.11-slim
WORKDIR /app
RUN pip install paho-mqtt requests numpy --no-cache-dir
COPY generator.py .
CMD ["python", "generator.py"]
