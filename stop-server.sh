#!/bin/bash
pkill -f "vite.*animdb" && echo "AnimDB detenido" || echo "No estaba en ejecución"
