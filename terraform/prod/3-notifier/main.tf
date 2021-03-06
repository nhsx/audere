// Copyright (c) 2019 by Audere
//
// Use of this source code is governed by an LGPL-3.0 license that
// can be found in the LICENSE file distributed with this file.

module "flu_notifier" {
  source = "../../modules/notifier"

  environment            = "prod"
  ssm_parameters_key_arn = data.terraform_remote_state.global.outputs.ssm_parameters_key_arn
}

data "terraform_remote_state" "global" {
  backend = "s3"
  config = {
    bucket = "global-terraform.auderenow.io"
    key    = "policy/terraform.state"
    region = "us-west-2"
  }
}

provider "aws" {
  version = "~> 2.61"
  region  = "us-west-2"
}

terraform {
  backend "s3" {
    bucket = "flu-prod-terraform.auderenow.io"
    key    = "notifier/terraform.state"
    region = "us-west-2"
  }
}
