#!/bin/sh
# pull generated clips from the shared project folder
mkdir -p assets/audio && cp /mnt/project-files/galeborn/audio/*.mp3 assets/audio/ && ls assets/audio | wc -l
