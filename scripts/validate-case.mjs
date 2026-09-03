#!/usr/bin/env node

import process from 'node:process';
import {runCli} from '../skills/ljq-broll-replica/scripts/validate-case.mjs';

process.exit(await runCli());
