#!/bin/bash
cd /home/kavia/workspace/code-generation/tictactoe-arena-115267-065a8a7e/tic_tac_toe_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

