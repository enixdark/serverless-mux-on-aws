import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda'
import * as apig from '@aws-cdk/aws-apigateway'
import * as path from 'path'
import * as ecs from '@aws-cdk/aws-ecs'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as logs from '@aws-cdk/aws-logs'
import { DualAlbFargateService} from 'cdk-fargate-patterns'

export class ServerlessMuxOnAwsStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const handler = new lambda.DockerImageFunction(this, 'Func', {
      code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../go')),
    })

    new apig.LambdaRestApi(this, 'API', { handler })

    const task = new ecs.FargateTaskDefinition(this, 'Task', { cpu: 256, memoryLimitMiB: 512 })
    task.addContainer('mux', {
      image: ecs.ContainerImage.fromAsset(path.join(__dirname, '../go'), {
        file: 'Dockerfile.fargate',
      }),
      portMappings: [{containerPort: 8080}],
      logging: new ecs.AwsLogDriver({
        streamPrefix: 'mux',
        logRetention: logs.RetentionDays.ONE_DAY,
      })
    })

    new DualAlbFargateService(this, 'FargateService', {
      vpc: getOrCreateVpc(this),
      spot: true,
      enableExecuteCommand: true,
      tasks: [ { task, external: { port: 80 } } ],
      route53Ops: { enableLoadBalancerAlias: false },
    })

    // The code that defines your stack goes here
  }
}


function getOrCreateVpc(scope: cdk.Construct): ec2.IVpc {
  // use an existing vpc or create a new one
  return scope.node.tryGetContext('use_default_vpc') === '1'
    || process.env.CDK_USE_DEFAULT_VPC === '1' ? ec2.Vpc.fromLookup(scope, 'Vpc', { isDefault: true }) :
    scope.node.tryGetContext('use_vpc_id') ?
      ec2.Vpc.fromLookup(scope, 'Vpc', { vpcId: scope.node.tryGetContext('use_vpc_id') }) :
      new ec2.Vpc(scope, 'Vpc', { maxAzs: 3, natGateways: 1 });
}
