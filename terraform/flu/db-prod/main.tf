// Copyright (c) 2018 by Audere
//
// Use of this source code is governed by an MIT-style license that
// can be found in the LICENSE file distributed with this file.

module "flu_db" {
  source = "../../modules/flu-db"

  admins = "${var.admins}"
  db_client_sg_id = "${data.terraform_remote_state.network.db_client_sg_id}"
  db_nonpii_subnet_id = "${data.terraform_remote_state.network.db_nonpii_subnet_id}"
  db_pii_subnet_id = "${data.terraform_remote_state.network.db_pii_subnet_id}"
  db_server_sg_id = "${data.terraform_remote_state.network.db_server_sg_id}"
  environment = "prod"
  internet_egress_sg_id = "${data.terraform_remote_state.network.internet_egress_sg_id}"
  log_archive_bucket_name = "${data.terraform_remote_state.global.database_log_archive_bucket_name}"
  mode = "${var.mode}"
  transient_subnet_id = "${data.terraform_remote_state.network.transient_subnet_id}"
}

module "ami" {
  source = "../../modules/ami"
}

module "vpc_cidr" {
  source = "../../modules/vpc-cidr"
}

provider "aws" {
  version = "~> 1.50"
  region = "us-west-2"
}

provider "template" {
  version = "~> 1.0"
}

data "terraform_remote_state" "global" {
  backend = "local"
  config {
    path = "../../global/terraform.tfstate"
  }
}

data "terraform_remote_state" "network" {
  backend = "s3"
  config {
    bucket = "flu-prod-terraform.auderenow.io"
    key = "network/terraform.state"
    region = "us-west-2"
  }
}

terraform {
  backend "s3" {
    bucket = "flu-prod-terraform.auderenow.io"
    key = "db/terraform.state"
    region = "us-west-2"
  }
}
